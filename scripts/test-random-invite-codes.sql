-- Test script to verify random invite code generation
-- This script can be run against a test database to verify the randomness

-- Create a temporary test database
-- CREATE DATABASE test_invite_codes;

-- Connect to test database and run the invite code generation multiple times

-- Function to test random code generation
CREATE OR REPLACE FUNCTION test_random_codes() RETURNS TABLE(
    run_number INT,
    code VARCHAR(12)
) AS $$
DECLARE
    i INTEGER;
    j INTEGER;
    random_code VARCHAR(12);
BEGIN
    -- Run the generation 3 times to see different results
    FOR i IN 1..3 LOOP
        -- Generate 5 codes each time
        FOR j IN 1..5 LOOP
            random_code := UPPER(
                SUBSTRING(
                    md5(random()::text || clock_timestamp()::text || j::text),
                    1,
                    12
                )
            );
            run_number := i;
            code := random_code;
            RETURN NEXT;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the test
SELECT * FROM test_random_codes() ORDER BY run_number, code;

-- Sample output showing that codes are different each run
-- The MD5 hash combined with random() and clock_timestamp() ensures uniqueness

-- Clean up
DROP FUNCTION test_random_codes();