const fs = require('fs');
const randomstring = require('randomstring');

function generateUsers(count = 100, outputFile = 'users.json', passwordLength = 12) {
  const firstNames = [
    'John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Jessica',
    'William', 'Emma', 'James', 'Olivia', 'Daniel', 'Sophia', 'Matthew', 'Isabella',
    'Liam', 'Noah', 'Ethan', 'Mia', 'Ava', 'Lucas', 'Elijah', 'Logan'
  ];

  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas',
    'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson'
  ];

  const users = [];
  const usedUsernames = new Set();

  while (users.length < count) {
    const first = firstNames[Math.floor(Math.random() * firstNames.length)];
    const last = lastNames[Math.floor(Math.random() * lastNames.length)];
    const uniqueId = randomstring.generate({ length: 6, charset: 'alphanumeric' });
    const username = `${first.toLowerCase()}${last.toLowerCase()}${uniqueId}`;

    if (usedUsernames.has(username)) continue;

    usedUsernames.add(username);

    users.push({
      name: `${first} ${last}`,
      username,
      email: `${username}@example.com`,
      password: randomstring.generate({ length: passwordLength, readable: false, charset: 'alphanumeric' }),
      phone: `08${randomstring.generate({ length: 10, charset: 'numeric' })}`
    });
  }

  fs.writeFileSync(outputFile, JSON.stringify(users, null, 2));
  console.log(`✅ Generated ${count} unique users into ${outputFile}`);
}

const count = parseInt(process.argv[2], 10) || 100;
const outputFile = process.argv[3] || 'users.json';
const passwordLength = parseInt(process.argv[4], 10) || 12;

generateUsers(count, outputFile, passwordLength);
