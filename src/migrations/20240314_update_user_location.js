'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Step 1: First make the column nullable
      await queryInterface.sequelize.query(`
        ALTER TABLE "Users" 
        ALTER COLUMN "currentLocation" DROP NOT NULL;
      `);

      // Step 2: Set default to null
      await queryInterface.sequelize.query(`
        ALTER TABLE "Users" 
        ALTER COLUMN "currentLocation" SET DEFAULT NULL;
      `);

      // Step 3: Update existing values to proper JSON format
      await queryInterface.sequelize.query(`
        UPDATE "Users" 
        SET "currentLocation" = 
          CASE 
            WHEN "currentLocation" IS NULL THEN NULL
            WHEN "currentLocation" ~ '^[0-9.-]+,\s*[0-9.-]+$' THEN 
              json_build_object(
                'latitude', CAST(split_part("currentLocation", ',', 1) AS FLOAT),
                'longitude', CAST(split_part("currentLocation", ',', 2) AS FLOAT)
              )::jsonb
            ELSE json_build_object('address', "currentLocation")::jsonb
          END;
      `);

      // Step 4: Change the column type to JSONB with explicit conversion
      await queryInterface.sequelize.query(`
        ALTER TABLE "Users" 
        ALTER COLUMN "currentLocation" TYPE JSONB 
        USING CASE 
          WHEN "currentLocation" IS NULL THEN NULL
          ELSE "currentLocation"::jsonb
        END;
      `);

      // Step 5: Add comment
      await queryInterface.sequelize.query(`
        COMMENT ON COLUMN "Users"."currentLocation" IS 'Stores location as {latitude: number, longitude: number} or {address: string}';
      `);
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Convert JSONB data back to text format before changing type
      await queryInterface.sequelize.query(`
        UPDATE "Users" 
        SET "currentLocation" = 
          CASE 
            WHEN "currentLocation" IS NULL THEN NULL
            WHEN "currentLocation"->>'latitude' IS NOT NULL THEN 
              concat(
                "currentLocation"->>'latitude', 
                ',', 
                "currentLocation"->>'longitude'
              )
            ELSE "currentLocation"->>'address'
          END;
      `);

      // Change type back to TEXT
      await queryInterface.sequelize.query(`
        ALTER TABLE "Users" 
        ALTER COLUMN "currentLocation" TYPE TEXT 
        USING "currentLocation"::text;
      `);
    } catch (error) {
      console.error('Migration rollback failed:', error);
      throw error;
    }
  }
}; 