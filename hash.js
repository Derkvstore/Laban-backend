const bcrypt = require('bcrypt');

bcrypt.hash('Laban7187', 10).then(hash => {
  console.log('Hash généré :', hash);
});
