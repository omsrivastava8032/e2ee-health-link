-- Allow authenticated users to insert their own profile
-- This is needed if the trigger didn't run or profile was deleted
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

