// db/migrations/20250415000005_create_sessions_table.js

exports.up = function(knex) {
    return knex.schema.createTable('sessions', (table) => {
      table.uuid('session_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('telegram_id').notNullable();
      table.jsonb('data').notNullable(); // temporary data for order/errand creation or registration
      table.timestamp('expires_at').notNullable();
      table.timestamps(true, true);
      
      // Index for faster lookup by telegram_id
      table.index('telegram_id');
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('sessions');
  };