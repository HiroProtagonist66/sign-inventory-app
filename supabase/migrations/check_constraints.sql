-- Query to check existing constraints on user_profiles table
SELECT 
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM 
    pg_constraint con
    JOIN pg_namespace nsp ON nsp.oid = con.connamespace
    JOIN pg_class cls ON cls.oid = con.conrelid
WHERE 
    cls.relname = 'user_profiles'
    AND con.contype = 'c'  -- 'c' for CHECK constraints
ORDER BY 
    con.conname;