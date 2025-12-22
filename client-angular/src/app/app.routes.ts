import { Routes } from '@angular/router';
import { ProductList } from './pages/product-list/product-list';
import { ProductDetail } from './pages/product-details/product-details';
import { OrderHistory } from './pages/order-history/order-history';
import { OpportunityCreateComponent } from './pages/opportunity-create/opportunity-create';
import { OpportunityListComponent } from './pages/opportunity-list/opportunity-list';


export const routes: Routes = [
    {path: 'store/c', component: ProductList},
    {path: 'product-detail', component:ProductDetail},
    {path: 'orders', component: OrderHistory},
    {path: 'crm/opportunities',component: OpportunityCreateComponent},
    {path: 'crm/opportunities/create',component: OpportunityCreateComponent},
    {path: 'crm/opportunities/list',component: OpportunityListComponent}
];
