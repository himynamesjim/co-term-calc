# Projects/Folders Feature - Implementation Guide

## Status: Backend Complete ✅ | Frontend Pending ⏳

This document outlines the projects/folders feature implementation for organizing CoTerm calculations.

---

## Part 1: Backend Infrastructure (✅ COMPLETE)

### Database Schema
**File**: `supabase-schema-folders.sql`

**To Apply**:
1. Go to your Supabase Dashboard → SQL Editor
2. Copy the contents of `supabase-schema-folders.sql`
3. Run the SQL to create:
   - `coterm_projects` table
   - `project_id` column in `coterm_calculations`
   - All necessary indexes and RLS policies

**Tables Created**:
- `coterm_projects`: Stores project/folder information
  - `id` (UUID)
  - `user_id` (UUID) - Foreign key to auth.users
  - `name` (TEXT) - Project name
  - `color` (TEXT) - Hex color code (default: #3b82f6)
  - `created_at`, `updated_at`

### API Endpoints
**File**: `app/api/projects/route.ts`

#### GET /api/projects
Fetch all projects for the authenticated user
```typescript
Response: { projects: Project[] }
```

#### POST /api/projects
Create a new project
```typescript
Body: { name: string, color?: string }
Response: { project: Project }
```

#### PUT /api/projects
Update a project
```typescript
Body: { id: string, name?: string, color?: string }
Response: { project: Project }
```

#### DELETE /api/projects
Delete a project
```typescript
Query: ?id=<project_id>
Response: { success: boolean }
```

### Updated save-design API
**File**: `app/api/save-design/route.ts`

Now accepts `projectId` parameter to associate calculations with projects.

---

## Part 2: Frontend Implementation (⏳ PENDING)

### Required Changes

#### 1. Add Projects State to page.tsx

```typescript
// Add to existing state declarations
const [projects, setProjects] = useState<any[]>([]);
const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
const [showNewProjectModal, setShowNewProjectModal] = useState(false);
```

#### 2. Fetch Projects on Mount

```typescript
// Add useEffect to fetch projects
useEffect(() => {
  const fetchProjects = async () => {
    if (!user) return;

    const token = await getSessionToken();
    const response = await fetch('/api/projects', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      setProjects(data.projects || []);
    }
  };

  fetchProjects();
}, [user]);
```

#### 3. Add Project Selector to Step 1

In the Agreement Information section (around line 2128), add after the red warning banner:

```tsx
{/* Project Selector */}
<div className="mb-6">
  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
    Project/Folder (Optional):
  </label>
  <div className="flex gap-2">
    <select
      value={selectedProjectId || ''}
      onChange={(e) => setSelectedProjectId(e.target.value || null)}
      className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      <option value="">No Project</option>
      {projects.map(project => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </select>
    <button
      onClick={() => setShowNewProjectModal(true)}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
    >
      New Project
    </button>
  </div>
  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
    💡 Organize your calculations by project or client
  </p>
</div>
```

#### 4. Update saveCalculation Function

Add `projectId` to the request body:

```typescript
const response = await fetch('/api/save-design', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    title: projectName,
    designData,
    designType: 'coterm-calc',
    userId: user.id,
    projectId: selectedProjectId  // ADD THIS LINE
  })
});
```

#### 5. Create New Project Modal Component

Create `components/new-project-modal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: any) => void;
}

export function NewProjectModal({ isOpen, onClose, onProjectCreated }: NewProjectModalProps) {
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = await getSessionToken();
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: projectName })
      });

      if (response.ok) {
        const data = await response.json();
        onProjectCreated(data.project);
        setProjectName('');
        onClose();
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-8 max-w-md w-full mx-4 border border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">New Project</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleCreate}>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Project Name
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
            placeholder="e.g., Acme Corp, Q1 2025"
            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white mb-4"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

#### 6. Update Sidebar to Group by Projects

Modify the saved calculations section (around line 1352) to group calculations by project:

```tsx
{/* Saved Calculations - Grouped by Project */}
<div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
    <h3>Saved Calculations</h3>
    {savedDesigns.length > 0 && (
      <button onClick={() => window.location.href = '/calcs'}>
        View All
      </button>
    )}
  </div>

  {/* Calculations with Projects */}
  {projects.map(project => {
    const projectCalcs = savedDesigns.filter(d => d.project_id === project.id);
    if (projectCalcs.length === 0) return null;

    return (
      <div key={project.id} style={{ marginBottom: "16px" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px",
          borderLeft: `3px solid ${project.color}`,
          background: "rgba(255,255,255,0.03)",
          borderRadius: "4px",
          marginBottom: "8px"
        }}>
          <FolderOpen size={16} style={{ color: project.color }} />
          <span style={{ fontWeight: "600", fontSize: "13px" }}>{project.name}</span>
          <span style={{ fontSize: "11px", opacity: 0.6 }}>({projectCalcs.length})</span>
        </div>
        {projectCalcs.map(design => (
          // Existing design card JSX here
        ))}
      </div>
    );
  })}

  {/* Calculations without Projects */}
  {savedDesigns.filter(d => !d.project_id).length > 0 && (
    <div>
      <div style={{ padding: "8px", marginBottom: "8px", opacity: 0.6 }}>
        Uncategorized
      </div>
      {savedDesigns.filter(d => !d.project_id).map(design => (
        // Existing design card JSX here
      ))}
    </div>
  )}

  {savedDesigns.length === 0 && (
    <div>No saved calculations yet</div>
  )}
</div>
```

---

## Testing Checklist

### Backend Testing
- [ ] Run SQL schema in Supabase
- [ ] Test GET /api/projects
- [ ] Test POST /api/projects
- [ ] Test PUT /api/projects
- [ ] Test DELETE /api/projects
- [ ] Verify RLS policies work correctly

### Frontend Testing (After Implementation)
- [ ] Project dropdown appears in Step 1
- [ ] Can create new projects
- [ ] Can select project when creating calculation
- [ ] Calculations save with correct project_id
- [ ] Sidebar groups calculations by project
- [ ] Project folders are collapsible
- [ ] Can move calculations between projects
- [ ] Deleting project doesn't delete calculations

---

## Future Enhancements (Phase 2)

- [ ] Drag & drop calculations between projects
- [ ] Rename projects inline
- [ ] Color picker for projects
- [ ] Project analytics (total calculations, last modified)
- [ ] Bulk move/delete calculations
- [ ] Search within projects
- [ ] Export entire project to ZIP
- [ ] Project sharing/collaboration

---

## Notes

- Projects are optional - calculations can exist without a project
- Deleting a project sets `project_id` to NULL (calculations are preserved)
- Each user can only see their own projects (enforced by RLS)
- Project colors use hex codes for consistency

