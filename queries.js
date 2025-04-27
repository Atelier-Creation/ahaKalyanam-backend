const CREATE_USER_PROFILE = `CREATE TABLE bio_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255),
    age INT,
    gender VARCHAR(10),
    city VARCHAR(255),
    date_of_birth DATE,
    time_of_birth TIME,
    place VARCHAR(255),
    father_name VARCHAR(255),
    mother_name VARCHAR(255),
    father_job VARCHAR(255),
    mother_job VARCHAR(255),
    no_of_siblings INT,
    siblings_marital_status VARCHAR(50),
    marital_status VARCHAR(50),
    mother_tongue VARCHAR(100),
    height VARCHAR(50),
    weight VARCHAR(50),
    blood_group VARCHAR(10),
    diet VARCHAR(50),
    disability VARCHAR(50),
    complexion VARCHAR(50),
    caste VARCHAR(100),
    sub_caste VARCHAR(100),
    gowthram VARCHAR(100),
    star VARCHAR(100),
    raasi VARCHAR(100),
    padam VARCHAR(100),
    laknam VARCHAR(100),
    job VARCHAR(255),
    place_of_job VARCHAR(255),
    income_per_month VARCHAR(50),
    qualification VARCHAR(255),
    permanent_address TEXT,
    present_address TEXT,
    contact_person VARCHAR(255),
    contact_number VARCHAR(20),
    partner_qualification VARCHAR(255),
    partner_job VARCHAR(255),
    partner_job_availability VARCHAR(50),
    partner_income VARCHAR(50),
    preferred_age VARCHAR(50),
    partner_diet VARCHAR(50),
    horoscope_required BOOLEAN,
    partner_marital_status VARCHAR(50),
    partner_caste VARCHAR(100),
    partner_sub_caste VARCHAR(100),
    image_1 TEXT,
    image_2 TEXT
);
`


const CREATE_USER_TABLE = `CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,  -- Store hashed passwords
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user'
);`


const CREATE_USER_LIKES = `CREATE TABLE user_likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,        -- The user who likes another profile
    user_liked_id INT NOT NULL,  -- The profile being liked
    liked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES bio_data(id) ON DELETE CASCADE,
    FOREIGN KEY (user_liked_id) REFERENCES bio_data(id) ON DELETE CASCADE
);`