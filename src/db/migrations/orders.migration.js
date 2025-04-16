// db/migrations/20250415000002_create_orders_table.js

exports.up = function(knex) {
    return knex.schema.createTable('orders', (table) => {
      table.uuid('order_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('customer_telegram_id').notNullable();
      table.jsonb('pickup_location').notNullable(); // {lat, lng, address}
      table.jsonb('dropoff_location').notNullable(); // {lat, lng, address}
      table.text('instructions');
      table.enum('status', ['pending', 'offered', 'accepted', 'in_progress', 'completed', 'canceled'])
        .defaultTo('pending')
        .notNullable();
      table.string('rider_id').references('telegram_id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('orders');
  };