# Task Manager API

A simple task manager API built with Express, TypeScript, and Zod.

## Features

- Task CRUD operations
- Input validation with Zod
- Error handling
- Health check endpoint

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and configure as needed:
   ```bash
   cp .env.example .env
   ```

3. Run the server:
   ```bash
   npm run dev
   ```

## API Endpoints

- `GET /health`: Health check
- `POST /tasks`: Create a new task
- `GET /tasks`: Get all tasks
- `GET /tasks/:id`: Get a task by ID
- `PUT /tasks/:id`: Update a task
- `DELETE /tasks/:id`: Delete a task

## Testing

Run tests:
```bash
npm test
```
