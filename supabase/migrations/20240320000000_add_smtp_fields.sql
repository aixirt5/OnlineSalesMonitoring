-- Add SMTP fields to myusers table
ALTER TABLE myusers
ADD COLUMN smtp_host varchar,
ADD COLUMN smtp_port integer,
ADD COLUMN smtp_user varchar,
ADD COLUMN smtp_pass varchar,
ADD COLUMN smtp_from varchar; 