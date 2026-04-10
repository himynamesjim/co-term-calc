-- Add folders/projects support to CoTerm Calculator
-- Run this SQL in your Supabase SQL Editor to add folder functionality

-- Create the projects/folders table
CREATE TABLE IF NOT EXISTS coterm_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6', -- Default blue color
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for projects
CREATE INDEX IF NOT EXISTS coterm_projects_user_id_idx ON coterm_projects(user_id);
CREATE INDEX IF NOT EXISTS coterm_projects_created_at_idx ON coterm_projects(created_at DESC);

-- Enable Row Level Security for projects
ALTER TABLE coterm_projects ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for projects
CREATE POLICY "Users can view their own projects"
  ON coterm_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
  ON coterm_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON coterm_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON coterm_projects FOR DELETE
  USING (auth.uid() = user_id);

-- Add project_id column to coterm_calculations table
ALTER TABLE coterm_calculations
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES coterm_projects(id) ON DELETE SET NULL;

-- Create index on project_id for faster queries
CREATE INDEX IF NOT EXISTS coterm_calculations_project_id_idx ON coterm_calculations(project_id);

-- Create a trigger to update projects updated_at
CREATE TRIGGER update_coterm_projects_updated_at
  BEFORE UPDATE ON coterm_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
