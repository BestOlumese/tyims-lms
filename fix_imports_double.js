const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

walkDir('upskill', function(filePath) {
    if (filePath.match(/\.(js|jsx|ts|tsx)$/)) {
        let content = fs.readFileSync(filePath, 'utf8');
        let newContent = content.replace(/"@\/upskill\/upskill\//g, '"@/upskill/').replace(/'@\/upskill\/upskill\//g, "'@/upskill/");
        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log('Fixed double upskill:', filePath);
        }
    }
});
