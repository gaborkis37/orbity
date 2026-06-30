import { helloShared, SHARED_PACKAGE_VERSION, type SharedStub } from '@orbity/shared';

export default function Home() {
  // Proves @orbity/shared imports + typechecks inside the web app (Task 1.1).
  const stub: SharedStub = helloShared();

  return (
    <main>
      <h1>Orbity</h1>
      <p>Real-time 3D satellite tracker — scaffold ready.</p>
      <p>
        shared import ok: <strong>{String(stub.ok)}</strong> ({stub.name} v
        {SHARED_PACKAGE_VERSION})
      </p>
    </main>
  );
}
