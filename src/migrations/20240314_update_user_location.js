'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1: First make the column nullable and remove any existing data
    await queryInterface.sequelize.query(`
      ALTER TABLE "Users" 
      ALTER COLUMN "currentLocation" DROP NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE "Users" 
      SET "currentLocation" = NULL;
    `);

    // Step 2: Change the column type to JSONB
    await queryInterface.sequelize.query(`
      ALTER TABLE "Users" 
      ALTER COLUMN "currentLocation" TYPE JSONB USING NULL;
    `);

    // Step 3: Add comment
    await queryInterface.sequelize.query(`
      COMMENT ON COLUMN "Users"."currentLocation" IS 'Stores location as {latitude: number, longitude: number} or {address: string}';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // If needed to rollback, convert back to the original type
    await queryInterface.sequelize.query(`
      ALTER TABLE "Users" 
      ALTER COLUMN "currentLocation" TYPE TEXT USING NULL;
    `);
  }
}; 