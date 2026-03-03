    -- This trigger automatically creates a profile record in Students or Tutors table
    -- when a new user signs up via Supabase Auth

    -- First, create a function that handles the profile creation
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
    DECLARE
    user_first_name TEXT;
    user_last_name TEXT;
    user_type TEXT;
    user_pricing_region TEXT;
    BEGIN
    -- Get user metadata
    user_first_name := NEW.raw_user_meta_data->>'first_name';
    user_last_name := NEW.raw_user_meta_data->>'last_name';
    user_type := NEW.raw_user_meta_data->>'user_type';
    user_pricing_region := NEW.raw_user_meta_data->>'pricing_region';
    
    -- If names are not provided, use empty strings
    IF user_first_name IS NULL THEN
        user_first_name := '';
    END IF;
    IF user_last_name IS NULL THEN
        user_last_name := '';
    END IF;
    IF user_pricing_region IS NULL THEN
        user_pricing_region := 'US';
    END IF;
    
    -- Create profile based on user_type
    IF user_type = 'student' THEN
        INSERT INTO public."Students" (user_id, first_name, last_name, email, credits, pricing_region)
        VALUES (NEW.id, user_first_name, user_last_name, NEW.email, 0, user_pricing_region)
        ON CONFLICT (user_id) DO NOTHING;
    ELSIF user_type = 'tutor' THEN
        INSERT INTO public."Tutors" (user_id, first_name, last_name, email, subjects, application_status, pricing_region)
        VALUES (NEW.id, user_first_name, user_last_name, NEW.email, '[]'::jsonb, false, user_pricing_region)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
    EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the user creation
        RAISE WARNING 'Error creating user profile: %', SQLERRM;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Create the trigger that fires after a new user is inserted
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

    -- Grant necessary permissions
    GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
    GRANT ALL ON public."Students" TO postgres, service_role;
    GRANT ALL ON public."Tutors" TO postgres, service_role;

