-- Create BlogPosts table for CMS
CREATE TABLE IF NOT EXISTS "BlogPosts" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    excerpt TEXT NOT NULL,
    content TEXT,
    category VARCHAR(100) DEFAULT 'General',
    read_time VARCHAR(50) DEFAULT '5 min read',
    featured_image TEXT,
    is_published BOOLEAN DEFAULT false,
    publish_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON "BlogPosts" (category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON "BlogPosts" (is_published);
CREATE INDEX IF NOT EXISTS idx_blog_posts_publish_date ON "BlogPosts" (publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON "BlogPosts" (slug);

-- Enable Row Level Security
ALTER TABLE "BlogPosts" ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read published posts
CREATE POLICY "Public can read published blog posts"
ON "BlogPosts"
FOR SELECT
USING (is_published = true);

-- Policy: Admins and Superadmins can do anything
CREATE POLICY "Admins can manage blog posts"
ON "BlogPosts"
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM admins WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM superadmins WHERE user_id = auth.uid()
    )
);

-- Insert sample data
INSERT INTO "BlogPosts" (title, slug, excerpt, content, category, read_time, is_published, publish_date)
VALUES (
    '5 Proven Study Techniques That Boost Student Performance',
    '5-proven-study-techniques-that-boost-student-performance',
    'Discover evidence-based learning strategies that help students retain information better and improve their academic outcomes.',
    '## Introduction

Studying effectively is more than just putting in hours—it''s about using the right techniques. Here are five proven methods to boost your performance:

### 1. Active Recall
Test yourself on the material instead of passively rereading. This strengthens memory connections.

### 2. Spaced Repetition
Review material at increasing intervals to move information into long-term memory.

### 3. The Pomodoro Technique
Work in focused 25-minute blocks with 5-minute breaks to maintain concentration.

### 4. Teach Others
Explaining concepts to others deepens your understanding and reveals knowledge gaps.

### 5. Mind Mapping
Create visual diagrams connecting related concepts to see the big picture.

## Conclusion

Implement these techniques consistently and watch your academic performance improve!',
    'Learning Tips',
    '5 min read',
    true,
    '2024-12-15T00:00:00Z'
);
