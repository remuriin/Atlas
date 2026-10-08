// The first thing a keyboard user reaches on every page.
// It jumps past the header straight to the page content.
function SkipLink() {
  const handleClick = (event) => {
    // Move focus ourselves so the page address is left alone.
    event.preventDefault();
    const main = document.getElementById('main-content');
    if (main) {
      main.focus();
      main.scrollIntoView();
    }
  };

  return (
    <a className="skip-link" href="#main-content" onClick={handleClick}>
      Skip to main content
    </a>
  );
}

export default SkipLink;
