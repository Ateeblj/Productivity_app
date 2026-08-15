import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ NOT the Daily Tasks feature's data store. This reads/writes the
// 'local_core_tasks' AsyncStorage key, which is completely separate from
// the real Daily Tasks screen (screens/DailyTaskScreen.tsx), which uses the
// 'dailyTasks' key. Nothing in the app currently imports this file. If you
// need task storage, use the 'dailyTasks' key / DailyTaskScreen's helpers
// instead — importing this service will silently create a second,
// invisible task list that the rest of the app never sees.

export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  reminderTime?: string;
  dueDate: string;
  createdAt?: number;
  updatedAt?: number;
}

export const tasksService = {
  async getAllTasks(): Promise<Task[]> {
    const data = await AsyncStorage.getItem('local_core_tasks');
    return data ? JSON.parse(data) : [];
  },

  async createTask(task: Omit<Task, 'id'>): Promise<string> {
    const tasks = await this.getAllTasks();
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    tasks.push({ ...task, id, createdAt: Date.now(), updatedAt: Date.now() });
    await AsyncStorage.setItem('local_core_tasks', JSON.stringify(tasks));
    return id;
  },

  async getTasksByDate(date: string): Promise<Task[]> {
    const tasks = await this.getAllTasks();
    return tasks.filter(t => t.dueDate === date);
  },

  async updateTask(task: Task): Promise<void> {
    const tasks = await this.getAllTasks();
    const updated = tasks.map(t => t.id === task.id ? { ...task, updatedAt: Date.now() } : t);
    await AsyncStorage.setItem('local_core_tasks', JSON.stringify(updated));
  },

  async deleteTask(taskId: string): Promise<void> {
    const tasks = await this.getAllTasks();
    const filtered = tasks.filter(t => t.id !== taskId);
    await AsyncStorage.setItem('local_core_tasks', JSON.stringify(filtered));
  },

  subscribeToTasks(callback: (tasks: Task[]) => void): () => void {
    this.getAllTasks().then(callback);
    // Lightweight polling to mimic real-time updates without PouchDB crashes
    const interval = setInterval(() => {
      this.getAllTasks().then(callback);
    }, 2000);
    return () => clearInterval(interval);
  },
};