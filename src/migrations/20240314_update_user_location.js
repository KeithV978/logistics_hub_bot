'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Step 1: First make the column nullable and set default to null
      await queryInterface.sequelize.query(`
        ALTER TABLE "Users" 
        ALTER COLUMN "currentLocation" DROP NOT NULL,
        ALTER COLUMN "currentLocation" SET DEFAULT NULL;
      `);

      // Step 2: Create a temporary JSONB column
      await queryInterface.sequelize.query(`
        ALTER TABLE "Users"
        ADD COLUMN "currentLocation_jsonb" JSONB;
      `);

      // Step 3: Convert existing data to JSONB in the temporary column
      await queryInterface.sequelize.query(`
        UPDATE "Users"
        SET "currentLocation_jsonb" = 
          CASE
            WHEN "currentLocation" IS NULL THEN NULL
            ELSE to_jsonb("currentLocation")
          END;
      `);

      // Step 4: Drop the old column and rename the new one
      await queryInterface.sequelize.query(`
        ALTER TABLE "Users"
        DROP COLUMN "currentLocation",
        ALTER COLUMN "currentLocation_jsonb" RENAME TO "currentLocation";
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
      // Step 1: Create a temporary TEXT column
      await queryInterface.sequelize.query(`
        ALTER TABLE "Users"
        ADD COLUMN "currentLocation_text" TEXT;
      `);

      // Step 2: Convert JSONB data back to text
      await queryInterface.sequelize.query(`
        UPDATE "Users"
        SET "currentLocation_text" = "currentLocation"::TEXT;
      `);

      // Step 3: Drop the JSONB column and rename the text column
      await queryInterface.sequelize.query(`
        ALTER TABLE "Users"
        DROP COLUMN "currentLocation",
        ALTER COLUMN "currentLocation_text" RENAME TO "currentLocation";
      `);
    } catch (error) {
      console.error('Migration rollback failed:', error);
      throw error;
    }
  }
}; 