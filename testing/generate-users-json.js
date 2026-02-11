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
  const usedNames = new Set();
  const usedUsernames = new Set();
  const usedEmails = new Set();
  const usedPhones = new Set();
  const usedPasswords = new Set();

  while (users.length < count) {
    const first = firstNames[Math.floor(Math.random() * firstNames.length)];
    const last = lastNames[Math.floor(Math.random() * lastNames.length)];

    const uniqueId = randomstring.generate({
      length: 6,
      charset: 'alphanumeric'
    });

    const name = `${first} ${last}`;
    const username = `${first.toLowerCase()}${last.toLowerCase()}${uniqueId}`;
    const email = `${username}@example.com`;
    const phone = `08${randomstring.generate({ length: 10, charset: 'numeric' })}`;

    const password = randomstring.generate({
      length: passwordLength,
      readable: false,
      charset: 'alphanumeric'
    });

    if (
      usedNames.has(name) ||
      usedUsernames.has(username) ||
      usedEmails.has(email) ||
      usedPhones.has(phone) ||
      usedPasswords.has(password)
    ) {
      continue;
    }

    usedNames.add(name);
    usedUsernames.add(username);
    usedEmails.add(email);
    usedPhones.add(phone);
    usedPasswords.add(password);

    users.push({
      name,
      username,
      email,
      password,
      phone
    });
  }

  fs.writeFileSync(outputFile, JSON.stringify(users, null, 2));
  console.log(`✅ Generated ${count} unique users into ${outputFile}`);
}

// CLI usage:
// node generate-users-json.js <count> <outputFile> <passwordLength>
const count = parseInt(process.argv[2], 10) || 100;
const outputFile = process.argv[3] || 'users.json';
const passwordLength = parseInt(process.argv[4], 10) || 12;

generateUsers(count, outputFile, passwordLength);
