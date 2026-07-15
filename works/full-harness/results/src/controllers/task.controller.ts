import { Request, Response } from 'express';
import { Task } from '../types/task.types';

// In-memory task storage
const tasks: Task[] = [];

const generateId = (): string => {
  return crypto.randomUUID();
};

const getCurrentDate = (): Date => {
  return new Date();
};

export const createTask = (req: Request, res: Response): Response => {
  const { title, description } = req.body;

  const task: Task = {
    id: generateId(),
    title,
    description,
    status: 'pending',
    createdAt: getCurrentDate(),
    updatedAt: getCurrentDate(),
  };

  tasks.push(task);

  return res.status(201).json({
    success: true,
    data: task,
  });
};

export const getTasks = (req: Request, res: Response): Response => {
  const { status, limit, offset } = req.query;

  let filteredTasks = [...tasks];

  // Filter by status if provided
  if (status && typeof status === 'string') {
    const validStatuses = ['pending', 'in_progress', 'completed'];
    if (validStatuses.includes(status)) {
      filteredTasks = filteredTasks.filter((task) => task.status === status);
    }
  }

  // Apply pagination
  const parsedLimit = limit ? parseInt(limit as string, 10) : undefined;
  const parsedOffset = offset ? parseInt(offset as string, 10) : undefined;

  if (parsedOffset !== undefined && parsedLimit !== undefined) {
    filteredTasks = filteredTasks.slice(parsedOffset, parsedOffset + parsedLimit);
  }

  return res.status(200).json({
    success: true,
    data: filteredTasks,
    meta: {
      total: tasks.length,
      limit: parsedLimit,
      offset: parsedOffset,
    },
  });
};

export const getTaskById = (req: Request, res: Response): Response => {
  const { id } = req.params;
  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return res.status(404).json({
      success: false,
      error: 'Task not found',
    });
  }

  return res.status(200).json({
    success: true,
    data: task,
  });
};

export const updateTask = (req: Request, res: Response): Response => {
  const { id } = req.params;
  const { title, description, status } = req.body;

  const taskIndex = tasks.findIndex((t) => t.id === id);

  if (taskIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Task not found',
    });
  }

  const updatedTask: Task = {
    ...tasks[taskIndex],
    title: title ?? tasks[taskIndex].title,
    description: description ?? tasks[taskIndex].description,
    status: status ?? tasks[taskIndex].status,
    updatedAt: getCurrentDate(),
  };

  tasks[taskIndex] = updatedTask;

  return res.status(200).json({
    success: true,
    data: updatedTask,
  });
};

export const deleteTask = (req: Request, res: Response): Response => {
  const { id } = req.params;
  const taskIndex = tasks.findIndex((t) => t.id === id);

  if (taskIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Task not found',
    });
  }

  const deletedTask = tasks.splice(taskIndex, 1)[0];

  return res.status(200).json({
    success: true,
    data: deletedTask,
  });
};
