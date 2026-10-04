// Board for the Orders sidebar group (All Orders, New Orders, Quotations, Cancelled)
registerBoard("order", {
  title: "Orders board",
  sub: "New orders to quote, quotes waiting for the customer, and cancelled orders",
  columns: [["new", "New"], ["quoted", "Quoted"], ["cancelled", "Cancelled"]],
});
