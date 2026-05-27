from setuptools import find_packages, setup

package_name = 'gressus_session'

setup(
    name=package_name,
    version='0.0.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='root',
    maintainer_email='ulan.sharipov@nu.edu.kz',
    description='HTTP session manager for Gressus launch files',
    license='Apache-2.0',
    extras_require={
        'test': [
            'pytest',
        ],
    },
    entry_points={
        'console_scripts': [
            'session_manager = gressus_session.session_manager:main',
        ],
    },
)
