import { Router, Request, Response } from 'express';
import { Task } from '../models/task';
import { createTaskSchema, updateTaskSchema } from '../validation/task';

const router = Router();

// In-memory storage
let tasks: Task[] = [];

// Helper to generate ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// POST /tasks
router.post('/', (req: Request, res: Response) => {
  const result = createTaskSchema.safeParse(req.body);
  
  if (!result.success) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: result.error.errors 
    });
  }

  const { title, description } = result.data;
  const now = new Date();

  const newTask: Task = {
    id: generateId(),
    title,
    description,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };

  tasks.push(newTask);
  res.status(201).json(newTask);
});

// GET /tasks
router.get('/', (req: Request, res: Response) => {
  res.json(tasks);
});

// GET /tasks/:id
router.get('/:id', (req: Request, res: Response) => {
  const task = tasks.find(t => t.id === req.params.id);
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

// PUT /tasks/:id
router.put('/:id', (req: Request, res: Response) => {
  const result = updateTaskSchema.safeParse(req.body);
  
  if (!result.success) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: result.error.errors 
    });
  }

  const taskIndex = tasks.findIndex(t => t.id === req.params.id);
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const { title, description, completed } = result.data;
  const now = new Date();

  tasks[taskIndex] = {
    ...tasks[taskIndex],
    title: title ?? tasks[taskIndex].title,
    description: description ?? tasks[taskIndex].description,
    completed: completed ?? tasks[taskIndex].completed,
    updatedAt: now,
  };

  res.json(tasks[taskIndex]);
});

// DELETE /tasks/:id
router.delete('/:id', (req: Request, res: Response) => {
  const taskIndex = tasks.findIndex(t => t.id === req.params.id);
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  tasks.splice(taskIndex, 1);
  res.status(204).send();
});

export default router;
