if (app.documents.length > 0) {
  var x = 102.5;
  var y = 333;
  var width = 205;
  var height = 117;

  var doc = app.activeDocument;
  doc.selection.select([
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height]
  ]);
}
