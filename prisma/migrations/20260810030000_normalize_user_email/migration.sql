UPDATE "User" SET email = lower(trim(email)) WHERE email <> lower(trim(email));
