// db/migrations/20250415000006_create_groups_table.js

exports.up = function(knex) {
    return knex.schema.createTable('groups', (table) => {
      table.string('group_id').primary(); // Telegram group ID
      table.uuid('order_id').references('order_id').inTable('orders').onDelete('CASCADE');
      table.uuid('errand_id').references('errand_id').inTable('errands').onDelete('CASCADE');
      table.string('customer_telegram_id').notNullable();
      table.string('rider_id').references('telegram_id').inTable('users').onDelete('SET NULL');
      table.string('errander_id').references('telegram_id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
      
      // Ensure only order_id XOR errand_id is set
      table.check('(?? IS NULL AND ?? IS NOT NULL) OR (?? IS NOT NULL AND ?? IS NULL)', 
        ['order_id', 'errand_id', 'order_id', 'errand_id']);
      
      // Ensure only rider_id XOR errander_id is set
      table.check('(?? IS NULL AND ?? IS NOT NULL) OR (?? IS NOT NULL AND ?? IS NULL)', 
        ['rider_id', 'errander_id', 'rider_id', 'errander_id']);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('groups');
  };