'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Step 1: Add a new JSONB column
      await queryInterface.sequelize.query(`
        ALTER TABLE "Users"
        ADD COLUMN "currentLocation_new" JSONB;
      `);

      // Step 2: Update the new column with converted data
      await queryInterface.sequelize.query(`
        UPDATE "Users"
        SET "currentLocation_new" = 
          CASE
            WHEN "currentLocation" IS NULL THEN NULL
            WHEN "currentLocation" ~ '^-?\d+\.?\d*,\s*-?\d+\.?\d*$' THEN
              jsonb_build_object(
                'latitude', (regexp_split_to_array("currentLocation", ','))[1]::float,
                'longitude', (regexp_split_to_array("currentLocation", ','))[2]::float
              )
            ELSE
              jsonb_build_object('address', "currentLocation")
          END;
      `);

      // Step 3: Drop the old column and rename the new one
      await queryInterface.sequelize.query(`
        ALTER TABLE "Users"
        DROP COLUMN "currentLocation",
        ALTER COLUMN "currentLocation_new" SET DEFAULT NULL,
        ALTER COLUMN "currentLocation_new" RENAME TO "currentLocation";
      `);

      // Step 4: Add comment to document the column format
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
      // Step 1: Add a temporary TEXT column
      await queryInterface.sequelize.query(`
        ALTER TABLE "Users"
        ADD COLUMN "currentLocation_old" TEXT;
      `);

      // Step 2: Convert JSONB data back to text format
      await queryInterface.sequelize.query(`
        UPDATE "Users"
        SET "currentLocation_old" = 
          CASE
            WHEN "currentLocation" IS NULL THEN NULL
            WHEN ("currentLocation"->>'latitude') IS NOT NULL THEN
              concat(
                "currentLocation"->>'latitude',
                ',',
                "currentLocation"->>'longitude'
              )
            ELSE
              "currentLocation"->>'address'
          END;
      `);

      // Step 3: Drop JSONB column and rename TEXT column back
      await queryInterface.sequelize.query(`
        ALTER TABLE "Users"
        DROP COLUMN "currentLocation",
        ALTER COLUMN "currentLocation_old" SET DEFAULT NULL,
        ALTER COLUMN "currentLocation_old" RENAME TO "currentLocation";
      `);

    } catch (error) {
      console.error('Migration rollback failed:', error);
      throw error;
    }
  }
}; 