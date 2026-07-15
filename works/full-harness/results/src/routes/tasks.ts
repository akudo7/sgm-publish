import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Task, CreateTaskInput, UpdateTaskInput } from '../types/task';
import { createTaskSchema, updateTaskSchema } from '../schemas/task';
import { AppError } from '../middleware/errorHandler';

// In-memory storage
const tasks: Task[] = [];

const router = Router();

// GET /tasks - List all tasks
router.get('/', (_req, res) => {
  res.status(200).json({ success: true, data: tasks });
});

// POST /tasks - Create a task
router.post('/', (req: Request<{}, {}, CreateTaskInput>, res, next) => {
  try {
    const validatedData = createTaskSchema.parse(req.body);
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: validatedData.title,
      description: validatedData.description,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    tasks.push(newTask);
    res.status(201).json({ success: true, data: newTask });
  } catch (err) {
    next(err);
  }
});

// GET /tasks/:id - Get a task by ID
router.get('/:id', (req: Request<{ id: string }>, res, next) => {
  try {
    const { id } = req.params;
    const task = tasks.find((t) => t.id === id);
    if (!task) {
      throw new AppError('Task not found', 404);
    }
    res.status(200).json({ success: true, data: task });
  } catch (err) {
    next(err);
  }
});

// PUT /tasks/:id - Update a task
router.put('/:id', (req: Request<{ id: string }, {}, UpdateTaskInput>, res, next) => {
  try {
    const { id } = req.params;
    const taskIndex = tasks.findIndex((t) => t.id === id);
    if (taskIndex === -1) {
      throw new AppError('Task not found', 404);
    }
    const validatedData = updateTaskSchema.parse(req.body);
    const updatedTask = {
      ...tasks[taskIndex],
      ...validatedData,
      updatedAt: new Date(),
    };
    tasks[taskIndex] = updatedTask;
    res.status(200).json({ success: true, data: updatedTask });
  } catch (err) {
    next(err);
  }
});

// DELETE /tasks/:id - Delete a task
router.delete('/:id', (req: Request<{ id: string }>, res, next) => {
  try {
    const { id } = req.params;
    const taskIndex = tasks.findIndex((t) => t.id === id);
    if (taskIndex === -1) {
      throw new AppError('Task not found', 404);
    }
    tasks.splice(taskIndex, 1);
    res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
