// src/services/postsService.js
import api from './api';

export const postsService = {
  // Get all posts
  async getAllPosts() {
    try {
      const response = await api.get('/posts');
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message || 'Failed to fetch posts'
      );
    }
  },

  // Get single post
  async getPost(id) {
    try {
      const response = await api.get(`/posts/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message || 'Failed to fetch post'
      );
    }
  },

  // Create new post
  async createPost(postData) {
    try {
      const response = await api.post('/posts', {
        title: postData.title,
        content: postData.content,
      });
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message || 'Failed to create post'
      );
    }
  },

  // Update post
  async updatePost(id, postData) {
    try {
      const response = await api.put(`/posts/${id}`, {
        title: postData.title,
        content: postData.content,
      });
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message || 'Failed to update post'
      );
    }
  },

  // Delete post
  async deletePost(id) {
    try {
      const response = await api.delete(`/posts/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(
        error.response?.data?.message || 'Failed to delete post'
      );
    }
  },
};