import request from 'supertest';
import { app } from '../server.js';

describe('Tasks API', () => {
  describe('GET /tasks/health', () => {
    it('should return 200 with status ok', async () => {
      const response = await request(app).get('/tasks/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /tasks', () => {
    it('should return empty tasks list initially', async () => {
      const response = await request(app).get('/tasks');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ tasks: [] });
    });
  });

  describe('POST /tasks', () => {
    it('should create a new task with valid data', async () => {
      const newTask = {
        title: 'Test Task',
        description: 'This is a test task',
        status: 'pending',
      };
      const response = await request(app).post('/tasks').send(newTask);
      expect(response.status).toBe(201);
      expect(response.body.task).toHaveProperty('id');
      expect(response.body.task.title).toBe('Test Task');
      expect(response.body.task.description).toBe('This is a test task');
      expect(response.body.task.status).toBe('pending');
      expect(response.body.task).toHaveProperty('createdAt');
      expect(response.body.task).toHaveProperty('updatedAt');
    });

    it('should return 400 when title is missing', async () => {
      const response = await request(app).post('/tasks').send({});
      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Validation failed');
    });

    it('should return 400 when title is empty', async () => {
      const response = await request(app).post('/tasks').send({ title: '' });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Validation failed');
    });

    it('should create task with default values when not provided', async () => {
      const response = await request(app).post('/tasks').send({ title: 'Minimal Task' });
      expect(response.status).toBe(201);
      expect(response.body.task.description).toBe('');
      expect(response.body.task.status).toBe('pending');
    });
  });

  describe('PUT /tasks/:id', () => {
    let createdTaskId: string;

    beforeAll(async () => {
      const response = await request(app).post('/tasks').send({
        title: 'Task to Update',
        description: 'Original description',
      });
      createdTaskId = response.body.task.id;
    });

    it('should update an existing task', async () => {
      const response = await request(app).put(`/tasks/${createdTaskId}`).send({
        title: 'Updated Task',
        status: 'in_progress',
      });
      expect(response.status).toBe(200);
      expect(response.body.task.title).toBe('Updated Task');
      expect(response.body.task.status).toBe('in_progress');
      expect(response.body.task.description).toBe('Original description');
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app).put('/tasks/non-existent-id').send({
        title: 'Non-existent',
      });
      expect(response.status).toBe(404);
      expect(response.body.error.message).toBe('Task not found');
    });

    it('should return 400 for invalid update data', async () => {
      const response = await request(app).put(`/tasks/${createdTaskId}`).send({
        title: '',
      });
      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Validation failed');
    });
  });

  describe('DELETE /tasks/:id', () => {
    let createdTaskId: string;

    beforeAll(async () => {
      const response = await request(app).post('/tasks').send({
        title: 'Task to Delete',
      });
      createdTaskId = response.body.task.id;
    });

    it('should delete an existing task', async () => {
      const response = await request(app).delete(`/tasks/${createdTaskId}`);
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Task deleted successfully');
    });

    it('should return 404 for non-existent task', async () => {
      const response = await request(app).delete('/tasks/non-existent-id');
      expect(response.status).toBe(404);
      expect(response.body.error.message).toBe('Task not found');
    });
  });
});
