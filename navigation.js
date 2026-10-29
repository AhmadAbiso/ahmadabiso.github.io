// Preserve previously shared links to sections that now have dedicated pages.
(() => {
 const pages = {publications:'publications',posts:'posts',projects:'projects',travels:'travels',notes:'posts'};
 const oldSection = location.hash.slice(1);
 if (pages[oldSection]) location.replace('/' + pages[oldSection] + '/' + (oldSection === 'notes' ? '#notes' : ''));
})();
