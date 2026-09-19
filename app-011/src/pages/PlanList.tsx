import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store';

export default function PlanList() {
  const { plans, addPlan, deletePlan } = useStore();
  const [name, setName] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    addPlan(name.trim());
    setName('');
  };

  return (
    <div>
      <h2 className="page-title">方案列表</h2>
      <div className="card">
        <div className="toolbar">
          <input
            type="text"
            placeholder="新方案名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button className="btn btn-primary" onClick={handleAdd}>
            创建方案
          </button>
        </div>
      </div>

      <div className="card">
        {plans.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', padding: '40px 0' }}>
            暂无方案，请创建一个新方案开始规划
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>方案名称</th>
                <th>房间数</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td>
                    <Link to={`/plan/${plan.id}`}>{plan.name}</Link>
                  </td>
                  <td>{plan.rooms.length}</td>
                  <td>{new Date(plan.createdAt).toLocaleString()}</td>
                  <td>
                    <Link className="btn btn-secondary" to={`/plan/${plan.id}`}>
                      编辑
                    </Link>
                    <Link className="btn btn-secondary" to={`/plan/${plan.id}/bom`}>
                      材料
                    </Link>
                    <button
                      className="btn btn-danger"
                      onClick={() => deletePlan(plan.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
