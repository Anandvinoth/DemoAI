//import { bootstrapApplication } from '@angular/platform-browser';
//import { appConfig } from './app/app.config';
//import { App } from './app/app';

//bootstrapApplication(App, appConfig)
 // .catch((err) => console.error(err));
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, {
    providers: [
    provideHttpClient(withFetch()),   // or just provideHttpClient()
    provideRouter(routes, withEnabledBlockingInitialNavigation())
  ]
});


