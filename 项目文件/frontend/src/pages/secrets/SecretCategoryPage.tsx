import { useParams, useNavigate } from 'react-router-dom';
import CategoryDetail from './CategoryDetail';

export default function SecretCategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();

  if (!categoryId) {
    return <div>分类 ID 不存在</div>;
  }

  return (
    <CategoryDetail
      categoryId={categoryId}
      onBack={() => navigate('/secrets')}
    />
  );
}
