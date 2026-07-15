import request from 'supertest';
import app from '../src/app';
import { Task } from '../src/models/task';

describe('Task API', () => {
  let createdTaskId: string;

  describe('POST /tasks', () => {
    it('should create a new task', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ title: 'Test Task', description: 'Test Description' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Test Task');
      expect(response.body.completed).toBe(false);
      createdTaskId = response.body.id;
    });

    it('should return 400 if title is missing', async () => {
      await request(app)
        .post('/tasks')
        .send({ description: 'No title' })
        .expect(400);
    });
  });

  describe('GET /tasks', () => {
    it('should return all tasks', async () => {
      const response = await request(app)
        .get('/tasks')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /tasks/:id', () => {
    it('should return a task by ID', async () => {
      const response = await request(app)
        .get(`/tasks/${createdTaskId}`)
        .expect(200);

      expect(response.body.id).toBe(createdTaskId);
    });

    it('should return 404 for non-existent task', async () => {
      await request(app)
        .get('/tasks/non-existent-id')
        .expect(404);
    });
  });

  describe('PUT /tasks/:id', () => {
    it('should update a task', async () => {
      const response = await request(app)
        .put(`/tasks/${createdTaskId}`)
        .send({ title: 'Updated Task', completed: true })
        .expect(200);

      expect(response.body.title).toBe('Updated Task');
      expect(response.body.completed).toBe(true);
    });

    it('should return 400 if validation fails', async () => {
      await request(app)
        .put(`/tasks/${createdTaskId}`)
        .send({ title: '' })
        .expect(400);
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('should delete a task', async () => {
      await request(app)
        .delete(`/tasks/${createdTaskId}`)
        .expect(204);

      await request(app)
        .get(`/tasks/${createdTaskId}`)
        .expect(404);
    });
  });
});
