import os
import time

import psycopg
from flask import Flask, jsonify, request
from flask_cors import CORS
from psycopg.rows import dict_row

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": os.environ.get("CORS_ORIGIN", "http://localhost:8080")}})

DATABASE_URL = os.environ["DATABASE_URL"]


def connect():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def initialize_database():
    for attempt in range(15):
        try:
            with connect() as connection:
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS tasks (
                        id SERIAL PRIMARY KEY,
                        title VARCHAR(160) NOT NULL,
                        completed BOOLEAN NOT NULL DEFAULT FALSE,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
            return
        except psycopg.OperationalError:
            if attempt == 14:
                raise
            time.sleep(2)


@app.get("/health")
def health():
    try:
        with connect() as connection:
            connection.execute("SELECT 1")
        return jsonify(status="ok", database="connected")
    except psycopg.Error:
        return jsonify(status="error", database="unavailable"), 503


@app.get("/api/tasks")
def list_tasks():
    with connect() as connection:
        tasks = connection.execute(
            "SELECT id, title, completed FROM tasks ORDER BY id DESC"
        ).fetchall()
    return jsonify(tasks)


@app.post("/api/tasks")
def create_task():
    body = request.get_json(silent=True) or {}
    title = body.get("title", "").strip()
    if not title or len(title) > 160:
        return jsonify(error="Enter a task title (1-160 characters)."), 400

    with connect() as connection:
        task = connection.execute(
            "INSERT INTO tasks (title) VALUES (%s) RETURNING id, title, completed",
            (title,),
        ).fetchone()
    return jsonify(task), 201


@app.patch("/api/tasks/<int:task_id>")
def update_task(task_id):
    body = request.get_json(silent=True) or {}
    if not isinstance(body.get("completed"), bool):
        return jsonify(error="A boolean completed value is required."), 400

    with connect() as connection:
        task = connection.execute(
            "UPDATE tasks SET completed = %s WHERE id = %s RETURNING id, title, completed",
            (body["completed"], task_id),
        ).fetchone()
    if task is None:
        return jsonify(error="Task not found."), 404
    return jsonify(task)


@app.delete("/api/tasks/<int:task_id>")
def delete_task(task_id):
    with connect() as connection:
        result = connection.execute("DELETE FROM tasks WHERE id = %s", (task_id,))
    if result.rowcount == 0:
        return jsonify(error="Task not found."), 404
    return "", 204


if __name__ == "__main__":
    initialize_database()
    app.run(host="0.0.0.0", port=5000)