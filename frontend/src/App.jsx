import { useCallback, useState } from "react";
import { CustomCursor, Nav, Foot } from "./shell.jsx";
import { Dashboard, Upload } from "./dashboard.jsx";
import { Search } from "./search.jsx";
import { Report } from "./report.jsx";

export default function App() {
  const [route, setRoute] = useState({ name: "dashboard", params: {} });

  const go = useCallback((name, params) => {
    setRoute({ name, params: params || {} });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  let view;
  if (route.name === "dashboard") view = <Dashboard go={go} />;
  else if (route.name === "search") view = <Search go={go} />;
  else if (route.name === "upload") view = <Upload go={go} route={route} />;
  else if (route.name === "report") view = <Report route={route} go={go} />;
  else view = <Dashboard go={go} />;

  return (
    <div className="app">
      <CustomCursor />
      <Nav route={route} go={go} />
      {view}
      <Foot />
    </div>
  );
}
