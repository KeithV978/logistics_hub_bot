// db/migrations/20250415000001_create_users_table.js

exports.up = function(knex) {
    return knex.schema.createTable('users', (table) => {
      table.string('telegram_id').primary();
      table.enum('role', ['rider', 'errander']).notNullable();
      table.string('full_name').notNullable();
      table.string('phone_number').notNullable();
      table.jsonb('bank_details'); // {accountName, accountNumber, bankName}
      table.string('nin');
      table.string('photo_url');
      table.float('rating').defaultTo(0);
      table.jsonb('reviews').defaultTo([]);
      table.boolean('is_verified').defaultTo(false);
      table.boolean('is_available').defaultTo(true);
      table.timestamps(true, true);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('users');
  };