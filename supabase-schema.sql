-- Create the coterm_calculations table
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS coterm_calculations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  design_type TEXT DEFAULT 'coterm-calc',
  design_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on user_id for faster queries
CREATE INDEX IF NOT EXISTS coterm_calculations_user_id_idx ON coterm_calculations(user_id);

-- Create an index on updated_at for sorting
CREATE INDEX IF NOT EXISTS coterm_calculations_updated_at_idx ON coterm_calculations(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE coterm_calculations ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can view their own calculations
CREATE POLICY "Users can view their own calculations"
  ON coterm_calculations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own calculations
CREATE POLICY "Users can insert their own calculations"
  ON coterm_calculations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own calculations
CREATE POLICY "Users can update their own calculations"
  ON coterm_calculations FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own calculations
CREATE POLICY "Users can delete their own calculations"
  ON coterm_calculations FOR DELETE
  USING (auth.uid() = user_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update updated_at
CREATE TRIGGER update_coterm_calculations_updated_at
  BEFORE UPDATE ON coterm_calculations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
