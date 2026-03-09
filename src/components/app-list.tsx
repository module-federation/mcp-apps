import type { AppData } from '../utils/types.js';

interface AppListProps {
  apps: AppData[];
  displayMode: 'inline' | 'fullscreen';
}

export function AppList({ apps, displayMode }: AppListProps) {
  if (apps.length === 0) {
    return null;
  }

  return (
    <div className="mf-apps-container">
      <h2 className="mf-apps-title">
        App List ({apps.length})
      </h2>
      <div className={`mf-apps-grid ${displayMode === 'fullscreen' ? 'fullscreen' : ''}`}>
        {apps.map((app, index) => (
          <div key={index} className="mf-app-card">
            <h3 className="mf-app-name">
              {app.name}
            </h3>
            <div className="mf-app-url">
              {app.url}
            </div>
            {app.exposedComponents && app.exposedComponents.length > 0 && (
              <div className="mf-app-components">
                <div className="mf-app-components-title">
                  Components ({app.exposedComponents.length})
                </div>
                <div className="mf-app-components-list">
                  {app.exposedComponents.map((comp: string, i: number) => (
                    <span key={i} className="mf-app-component-tag">
                      {comp}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {app.remotes && Object.keys(app.remotes).length > 0 && (
              <div className="mf-app-remotes">
                <div className="mf-app-remotes-title">
                  Remote Modules
                </div>
                <div className="mf-app-remotes-list">
                  {Object.entries(app.remotes).map(([name, url]: [string, unknown]) => (
                    <div key={name} className="mf-app-remote-item">
                      <span className="mf-app-remote-name">{name}</span>: {String(url)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
