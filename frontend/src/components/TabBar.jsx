// A row of tabs that follows the standard keyboard pattern for tabs:
//   Tab moves into the row (onto the selected tab) and out again,
//   Left/Right arrows move between tabs, Home/End jump to the first/last.
//
// props:
//   label      what the tabs are for, read by screen readers
//   tabs       [{ id: 'top', label: 'Top', icon: 'arrow-up' }]  (icon is optional)
//   activeId   id of the selected tab
//   panelId    id of the element that shows the selected tab's content
//   onChange   called with the id of the newly selected tab

import Icon from './Icon';

function TabBar(props) {
  const selectTab = (tab) => {
    props.onChange(tab.id);
    // Focus follows the selection, as the pattern expects.
    const tabButton = document.getElementById(`tab-${tab.id}`);
    if (tabButton) {
      tabButton.focus();
    }
  };

  const handleKeyDown = (event, index) => {
    const lastIndex = props.tabs.length - 1;
    let nextIndex = index;

    if (event.key === 'ArrowRight') {
      nextIndex = index + 1;
      if (nextIndex > lastIndex) {
        nextIndex = 0;
      }
    } else if (event.key === 'ArrowLeft') {
      nextIndex = index - 1;
      if (nextIndex < 0) {
        nextIndex = lastIndex;
      }
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = lastIndex;
    } else {
      // Any other key keeps its normal behaviour.
      return;
    }

    event.preventDefault();
    selectTab(props.tabs[nextIndex]);
  };

  return (
    <div className="tab-bar" role="tablist" aria-label={props.label}>
      {props.tabs.map((tab, index) => {
        const isSelected = tab.id === props.activeId;
        // Only the selected tab is a Tab stop; the arrow keys reach the others.
        let tabIndex = -1;
        if (isSelected) {
          tabIndex = 0;
        }

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            className="tab"
            aria-selected={isSelected}
            aria-controls={props.panelId}
            tabIndex={tabIndex}
            onClick={() => props.onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab.icon && <Icon name={tab.icon} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default TabBar;
