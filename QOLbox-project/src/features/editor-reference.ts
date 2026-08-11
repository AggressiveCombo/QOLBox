export type EditorReferenceSection = readonly [string, readonly (readonly [string, string])[]];

export const EDITOR_REFERENCE_SECTIONS: readonly EditorReferenceSection[] = [
  ['Clipboard', [
    ['Copy selected objects', 'Select one or more objects and press Ctrl+C. Every copyable object is copied together, preserving the spacing between them.'],
    ['Delete selected objects', 'Press Delete to remove every selected object in one undoable operation.'],
    ['Paste copied objects', 'Press Ctrl+V to paste the copied objects at their original spacing. The new copies are selected immediately.'],
    ['Undo and redo', 'Press Ctrl+Z to undo and Ctrl+Y to redo editor changes, including multi-object operations.'],
  ]],
  ['Colors', [
    ['Background colors', 'Open BG, then enter #RGB or #RRGGBB below Top Color or Bot Color to set an exact map background color.'],
    ['Color picker', 'Select one or more objects, press I, then click an object\'s fill or outline. The sampled color is applied to every compatible selected object and becomes the active paint color.'],
    ['Exact paint colors', 'Enter #RGB or #RRGGBB below Color or Stroke to set an exact color.'],
    ['Mixed paint colors', 'When selected objects use different colors, the Color and Stroke swatches split into equal slices for each distinct color and the matching hex field shows Mixed.'],
  ]],
  ['Groups', [
    ['Merged groups', 'Select bodies and choose Tools → Merge Shapes. The bodies remain separate internally, but normal selection, movement, rotation, clipboard actions, and compatible properties treat them as one group.'],
    ['Subbody editing', 'Ctrl-click a member of a merged group directly to select only that body. Its dashed red outline identifies the special selection; dragging and property changes affect only that subbody.'],
    ['Ungroup a subbody', 'With a subbody selected, choose Ungroup in Subbody Properties to detach it while leaving the rest of the group intact.'],
  ]],
  ['Maps', [
    ['Editor Save', 'Enable Editor Save in QOLBox Features to keep Hitbox\'s native Save action available after loading a map.'],
    ['Export maps', 'Choose File → Export to download the current map to your computer.'],
    ['Import maps', 'Choose File → Import to load a compact .hitboxmap file, readable JSON, or compatible text map from your computer. QOLBox validates the data and restores the previous map if loading fails.'],
    ['Readable exports', 'Enable Readable map exports in QOLBox Advanced settings to export formatted JSON instead of compact map data.'],
  ]],
  ['Selection', [
    ['Area selection', 'With Select active, drag from empty map space to select every object touched by the bright box. Hold Shift or Ctrl while dragging to toggle those objects instead.'],
    ['Compatible properties', 'When selected objects have different types, a property or paint change applies only to objects that support it; unsupported objects stay unchanged.'],
    ['Mixed values', 'Mixed means the selected objects currently have different values for that property. Enter or choose a value to apply it to every compatible object.'],
    ['Modifier selection', 'Shift-click or Ctrl-click an object to add it to the current selection or remove it.'],
    ['Move selections', 'Drag any selected object to move the complete selection by the same snapped offset.'],
    ['Object IDs', 'ID labels remain visible for every selected object that has one, making related objects easier to identify.'],
  ]],
  ['Transform', [
    ['Mirror', 'Select one or more objects, then open Tools → Mirror and choose Horizontal or Vertical. One object mirrors in place; a selection mirrors together around its shared center.'],
    ['Relative values', 'Enter =+3 or =-3 in a numeric property to change each compatible object by that amount while preserving the differences between their current values.'],
  ]],
];
