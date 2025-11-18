// src/hooks/usePosts.js
import { useState, useEffect } from 'react';
import { postsService } from '../services/postsService';

export const usePosts = () => {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load all posts
  const loadPosts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await postsService.getAllPosts();
      
      if (response.success) {
        setPosts(response.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Create new post
  const createPost = async (postData) => {
    try {
      setError(null);
      const response = await postsService.createPost(postData);
      
      if (response.success) {
        // Add new post to the beginning of the array
        setPosts(prevPosts => [response.data, ...prevPosts]);
        return { success: true, data: response.data };
      }
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Update post
  const updatePost = async (id, postData) => {
    try {
      setError(null);
      const response = await postsService.updatePost(id, postData);
      
      if (response.success) {
        // Update post in the array
        setPosts(prevPosts =>
          prevPosts.map(post =>
            post.id === id ? response.data : post
          )
        );
        return { success: true, data: response.data };
      }
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Delete post
  const deletePost = async (id) => {
    try {
      setError(null);
      const response = await postsService.deletePost(id);
      
      if (response.success) {
        // Remove post from array
        setPosts(prevPosts => prevPosts.filter(post => post.id !== id));
        return { success: true };
      }
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Load posts on mount
  useEffect(() => {
    loadPosts();
  }, []);

  return {
    posts,
    isLoading,
    error,
    loadPosts,
    createPost,
    updatePost,
    deletePost,
  };
};