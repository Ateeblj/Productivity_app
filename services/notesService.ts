// services/notesService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as syncedStorage from './syncedStorage';
import { Note, Folder, NoteType } from '../types';
import { mediaService } from './mediaService';

const NOTES_KEY = 'myNotes';
const FOLDERS_KEY = 'myFolders';

// ============================================================
// NOTES
// ============================================================

export async function getNotes(): Promise<Note[]> {
  const data = await AsyncStorage.getItem(NOTES_KEY);
  const notes: Note[] = data ? JSON.parse(data) : [];
  return notes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function subscribeToNotes(callback: (notes: Note[]) => void): () => void {
  getNotes().then(callback);
  const interval = setInterval(() => {
    getNotes().then(callback);
  }, 2000);
  return () => clearInterval(interval);
}

export async function createNote(data: {
  title: string;
  content: string;
  color?: string;
  type?: NoteType;
  mediaUri?: string;
  duration?: number;
  folderId?: string | null;
}): Promise<Note> {
  const notes = await getNotes();
  const now = Date.now();

  const newNote: Note = {
    id: `note_${now}_${Math.random().toString(36).slice(2, 8)}`,
    title: data.title,
    content: data.content,
    type: data.type ?? 'text',
    mediaUri: data.mediaUri,
    duration: data.duration,
    color: data.color ?? '#FFFFFF',
    isPinned: false,
    folderId: data.folderId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  notes.push(newNote);
  await syncedStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  return newNote;
}

export async function updateNote(
  noteId: string,
  changes: Partial<Pick<Note, 'title' | 'content' | 'color' | 'isPinned' | 'folderId'>>
): Promise<void> {
  const notes = await getNotes();
  const updated = notes.map((n) =>
    n.id === noteId ? { ...n, ...changes, updatedAt: Date.now() } : n
  );
  await syncedStorage.setItem(NOTES_KEY, JSON.stringify(updated));
}

export async function deleteNote(noteId: string): Promise<void> {
  const notes = await getNotes();
  const noteToDelete = notes.find((n) => n.id === noteId);

  // Clean up any recorded media file this note owned
  if (noteToDelete?.mediaUri) {
    await mediaService.deleteMedia(noteToDelete.mediaUri);
  }

  const filtered = notes.filter((n) => n.id !== noteId);
  await syncedStorage.setItem(NOTES_KEY, JSON.stringify(filtered));
}

export async function togglePin(noteId: string, currentlyPinned: boolean): Promise<void> {
  await updateNote(noteId, { isPinned: !currentlyPinned });
}

export async function moveNoteToFolder(noteId: string, folderId: string | null): Promise<void> {
  await updateNote(noteId, { folderId });
}

// ============================================================
// FOLDERS
// ============================================================

export async function getFolders(): Promise<Folder[]> {
  const data = await AsyncStorage.getItem(FOLDERS_KEY);
  const folders: Folder[] = data ? JSON.parse(data) : [];
  return folders.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export function subscribeToFolders(callback: (folders: Folder[]) => void): () => void {
  getFolders().then(callback);
  const interval = setInterval(() => {
    getFolders().then(callback);
  }, 2000);
  return () => clearInterval(interval);
}

// UPDATED: createFolder with parentId
export async function createFolder(name: string, color: string, parentId: string | null = null): Promise<Folder> {
  const folders = await getFolders();
  const now = Date.now();

  const newFolder: Folder = {
    id: `folder_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || 'Untitled Folder',
    color,
    parentId,
    createdAt: now,
    updatedAt: now,
  };

  folders.push(newFolder);
  await syncedStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  return newFolder;
}

export async function renameFolder(folderId: string, name: string): Promise<void> {
  const folders = await getFolders();
  const updated = folders.map((f) =>
    f.id === folderId ? { ...f, name: name.trim() || f.name, updatedAt: Date.now() } : f
  );
  await syncedStorage.setItem(FOLDERS_KEY, JSON.stringify(updated));
}

// UPDATED: deleteFolder handles subfolders and notes
export async function deleteFolder(folderId: string): Promise<void> {
  const [folders, notes] = await Promise.all([getFolders(), getNotes()]);

  // Move all notes from this folder to top level
  const updatedNotes = notes.map((n) =>
    n.folderId === folderId ? { ...n, folderId: null, updatedAt: Date.now() } : n
  );
  await syncedStorage.setItem(NOTES_KEY, JSON.stringify(updatedNotes));

  // Move all subfolders (parentId === folderId) to top level
  const updatedFolders = folders.map((f) =>
    f.parentId === folderId ? { ...f, parentId: null, updatedAt: Date.now() } : f
  );
  // Remove the deleted folder itself
  const filteredFolders = updatedFolders.filter((f) => f.id !== folderId);

  await syncedStorage.setItem(FOLDERS_KEY, JSON.stringify(filteredFolders));
}