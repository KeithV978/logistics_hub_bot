// db/migrations/20250415000003_create_errands_table.js

exports.up = function(knex) {
    return knex.schema.createTable('errands', (table) => {
      table.uuid('errand_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('customer_telegram_id').notNullable();
      table.jsonb('location').notNullable(); // {lat, lng, address}
      table.text('description').notNullable();
      table.enum('status', ['pending', 'offered', 'accepted', 'in_progress', 'completed', 'canceled'])
        .defaultTo('pending')
        .notNullable();
      table.string('errander_id').references('telegram_id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('errands');
  };