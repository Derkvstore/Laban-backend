const bcrypt = require('bcrypt');

bcrypt.hash('Wassolo25', 10).then(hash => {
  console.log('Hash généré :', hash);
});

// const bcrypt = require('bcrypt');

// bcrypt.hash('derkv10', 10).then(hash => {
//   console.log('Hash généré :', hash);
// });
