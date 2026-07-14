import { Router } from 'express';
import Nedb from '@seald-io/nedb';
import { Dashboard, Namespace } from '../types';
export declare function queryRouter(dashboards: Nedb<Dashboard>, namespaces: Nedb<Namespace>): Router;
