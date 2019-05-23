import { Request, Response, Router } from 'express';

const router: Router = Router();

router.get('/', (_: Request, res: Response) => {
    res.json({
        result: 'Hello Lemon',
    });
});

export default router;
